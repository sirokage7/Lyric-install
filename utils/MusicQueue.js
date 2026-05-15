const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  entersState,
  joinVoiceChannel,
  getVoiceConnection,
} = require('@discordjs/voice');
const youtubedl = require('youtube-dl-exec');
const playdl = require('play-dl');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const queues = require('./queues');

function formatDuration(sec) {
  if (!sec) return '??:??';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

class Song {
  constructor({ title, url, duration, thumbnail, requestedBy, channelName }) {
    this.title = title;
    this.url = url;
    this.duration = duration;
    this.thumbnail = thumbnail;
    this.requestedBy = requestedBy;
    this.channelName = channelName ?? '알 수 없음';
  }
}

class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.songs = [];
    this.currentSong = null;
    this.textChannel = null;
    this.connection = null;
    this.loop = 'off'; // 'off' | 'single' | 'all' | 'autoplay'
    this.volume = 100;
    this._resource = null;
    this.npMessage = null;
    this._skipLoopOnce = false;
    this._idleTimer = null;
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Idle, () => {
      if (!this._skipLoopOnce && this.currentSong) {
        if (this.loop === 'single') this.songs.unshift(this.currentSong);
        else if (this.loop === 'all') this.songs.push(this.currentSong);
      }
      this._skipLoopOnce = false;
      this._next();
    });
    this.player.on('error', (err) => {
      console.error('[Lyric] 플레이어 오류:', err.message);
      this._next();
    });
  }

  _buildWaitingEmbed() {
    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setAuthor({ name: '🎵 Lyric | 재생 대기중...' })
      .setDescription('새로운 음악이 추가되기를 기다리고 있어요!');
  }

  _buildEmbed() {
    const song = this.currentSong;
    const trackMode = this.songs.length === 0
      ? '단일 트랙 재생중'
      : `플레이리스트 재생중 (${this.songs.length + 1}곡)`;

    return new EmbedBuilder()
      .setColor(0x9B59B6)
      .setAuthor({ name: '🎵 Lyric | 음악 재생중...' })
      .setDescription(`${trackMode}\n**[${song.title}](${song.url})**`)
      .addFields(
        { name: '노래 길이', value: formatDuration(song.duration), inline: true },
        { name: '대기중인 곡', value: `${this.songs.length}개`, inline: true },
        { name: '볼륨', value: `${this.volume}%`, inline: true },
        { name: '반복', value: this.loop === 'single' ? '`🔁 한곡반복`' : this.loop === 'all' ? '`🔁 전체반복`' : this.loop === 'autoplay' ? '`▶️ 자동재생`' : '반복없음', inline: true },
        { name: '요청자', value: song.requestedBy, inline: true },
        { name: '채널명', value: song.channelName, inline: true },
      )
      .setThumbnail(song.thumbnail ?? null);
  }

  _buildSelectMenu(disabled = false) {
    const menu = new StringSelectMenuBuilder().setCustomId('lyric_queue_select');
    const hasQueue = this.songs.length > 0 && !disabled;

    if (!hasQueue) {
      return new ActionRowBuilder().addComponents(
        menu
          .setPlaceholder('다음 곡 : 다음곡이 존재하지 않아요!')
          .setDisabled(disabled)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('대기열에 노래가 존재하지 않아요.').setValue('_empty'),
          ),
      );
    }

    return new ActionRowBuilder().addComponents(
      menu
        .setPlaceholder(`다음 곡 : ${this.songs[0].title}`)
        .addOptions(
          this.songs.slice(0, 25).map((s, i) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${i + 1}. ${s.title.slice(0, 95)}`)
              .setValue(`skip_to_${i}`)
              .setDescription(formatDuration(s.duration)),
          ),
        ),
    );
  }

  _buildButtonRows(disabled = false) {
    const isPaused = this.player.state.status === AudioPlayerStatus.Paused;

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lyric_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_restart').setEmoji('⏮️').setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_pause').setEmoji(isPaused ? '▶️' : '⏸️').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_skip').setEmoji('⏭️').setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lyric_loop').setEmoji('🔁').setStyle(
        this.loop === 'single' ? ButtonStyle.Success :
        this.loop === 'all' ? ButtonStyle.Primary :
        this.loop === 'autoplay' ? ButtonStyle.Danger :
        ButtonStyle.Secondary
      ).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_queue').setLabel('≡').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_vol_down').setLabel('◄').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_vol_up').setLabel('►').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId('lyric_star').setLabel('★').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    );

    return [row1, row2];
  }

  _buildComponents(disabled = false) {
    return [this._buildSelectMenu(disabled), ...this._buildButtonRows(disabled)];
  }

  _startIdleTimer() {
    this._clearIdleTimer();
    this._idleTimer = setTimeout(async () => {
      if (this.textChannel) {
        await this.textChannel.send({
          embeds: [new EmbedBuilder()
            .setColor(0xE74C3C)
            .setDescription('플레이어가 5분동안 비활성화상태여서 자동으로 종료되었어요!')],
        });
      }
      this.destroy();
    }, 5 * 60 * 1000);
  }

  _clearIdleTimer() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
  }

  async updateNowPlaying() {
    if (!this.npMessage || !this.currentSong) return;
    try {
      await this.npMessage.edit({
        embeds: [this._buildEmbed()],
        components: this._buildComponents(),
      });
    } catch {}
  }

  getQueueEmbed() {
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('📋 재생 목록')
      .addFields({
        name: '▶️ 현재 재생 중',
        value: `**[${this.currentSong.title}](${this.currentSong.url})** (${formatDuration(this.currentSong.duration)})`,
      });
    if (this.songs.length) {
      const list = this.songs.slice(0, 10)
        .map((s, i) => `**${i + 1}.** [${s.title}](${s.url}) (${formatDuration(s.duration)})`)
        .join('\n');
      embed.addFields({ name: '🎶 다음 곡', value: list });
      if (this.songs.length > 10) embed.setFooter({ text: `... 그 외 ${this.songs.length - 10}곡 더 있어요` });
    } else {
      embed.addFields({ name: '🎶 다음 곡', value: '없음' });
    }
    return embed;
  }

  async join(voiceChannel) {
    const existing = getVoiceConnection(voiceChannel.guild.id);
    if (existing) existing.destroy();

    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.subscribe(this.player);
    await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        if (this.textChannel) {
          this.textChannel.send({ content: '👋 음성 채널에서 연결이 끊겼어요!' }).catch(() => {});
        }
        this.destroy();
      }
    });
  }

  async addSong(song) {
    this._clearIdleTimer();
    this.songs.push(song);
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this._next();
      return true;
    }
    await this.updateNowPlaying();
    return false;
  }

  async _next() {
    if (this.loop === 'autoplay' && !this.songs.length && this.currentSong) {
      try {
        const query = this.currentSong.channelName !== '알 수 없음'
          ? `${this.currentSong.channelName} ${this.currentSong.title}`
          : this.currentSong.title;
        const results = await playdl.search(query, { limit: 10, source: { youtube: 'video' } });
        const filtered = results.filter((r) => r.url !== this.currentSong.url);
        if (filtered.length) {
          const pick = filtered[Math.floor(Math.random() * Math.min(5, filtered.length))];
          this.songs.push(new Song({
            title: pick.title ?? '제목 없음',
            url: pick.url,
            duration: pick.durationInSec,
            thumbnail: pick.thumbnails?.[0]?.url ?? null,
            requestedBy: '🤖 자동재생',
            channelName: pick.channel?.name ?? '알 수 없음',
          }));
        }
      } catch {}
    }

    if (!this.songs.length) {
      this.currentSong = null;
      if (this.npMessage) {
        this.npMessage.edit({
          embeds: [this._buildWaitingEmbed()],
          components: this._buildComponents(true),
        }).catch(() => {});
      }
      this._startIdleTimer();
      return;
    }

    this.currentSong = this.songs.shift();

    try {
      if (this.textChannel) {
        if (this.npMessage) this.npMessage.delete().catch(() => {});
        this.npMessage = await this.textChannel.send({
          embeds: [new EmbedBuilder().setColor(0x9B59B6).setDescription('패널 생성중...')],
        });
      }

      const ytProcess = youtubedl.exec(
        this.currentSong.url,
        { output: '-', quiet: true, format: '251/bestaudio[acodec=opus]', noPlaylist: true },
        { stdio: ['ignore', 'pipe', 'ignore'] },
      );
      ytProcess.stdout.on('error', () => {});

      const resource = createAudioResource(ytProcess.stdout, { inputType: StreamType.WebmOpus, inlineVolume: true });
      resource.volume?.setVolume(this.volume / 100);
      this._resource = resource;
      this.player.play(resource);

      if (this.npMessage) {
        await this.npMessage.edit({
          embeds: [this._buildEmbed()],
          components: this._buildComponents(),
        });
      }
    } catch (err) {
      console.error(`[Lyric] 스트리밍 오류 (${this.currentSong.title}):`, err.message);
      if (this.textChannel) {
        this.textChannel.send(`⚠️ **${this.currentSong.title}** 재생 실패. 다음 곡으로 넘어갑니다.`);
      }
      await this._next();
    }
  }

  pause() {
    return this.player.state.status === AudioPlayerStatus.Playing && this.player.pause();
  }

  resume() {
    return this.player.state.status === AudioPlayerStatus.Paused && this.player.unpause();
  }

  skip() {
    this.player.stop();
  }

  restart() {
    if (!this.currentSong) return false;
    this._skipLoopOnce = true;
    this.songs.unshift(this.currentSong);
    this.player.stop();
    return true;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(100, vol));
    if (this._resource?.volume) {
      this._resource.volume.setVolume(this.volume / 100);
    }
  }

  toggleLoop() {
    const states = ['off', 'single', 'all', 'autoplay'];
    this.loop = states[(states.indexOf(this.loop) + 1) % states.length];
    return this.loop;
  }

  async shuffle() {
    if (!this.currentSong) return;
    this.songs = [];

    try {
      const query = this.currentSong.channelName !== '알 수 없음'
        ? this.currentSong.channelName
        : this.currentSong.title;

      const results = await playdl.search(query, { limit: 40, source: { youtube: 'video' } });
      const filtered = results.filter((r) =>
        r.url !== this.currentSong.url &&
        r.durationInSec >= 60 &&
        r.durationInSec <= 720
      );

      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }

      for (const video of filtered.slice(0, 20)) {
        this.songs.push(new Song({
          title: video.title ?? '제목 없음',
          url: video.url,
          duration: video.durationInSec,
          thumbnail: video.thumbnails?.[0]?.url ?? null,
          requestedBy: '🔀 셔플',
          channelName: video.channel?.name ?? '알 수 없음',
        }));
      }
    } catch (err) {
      console.error('[Lyric] 셔플 오류:', err.message);
    }
  }

  skipToIndex(index) {
    if (index < 0 || index >= this.songs.length) return false;
    this.songs.splice(0, index);
    this.player.stop();
    return true;
  }

  destroy() {
    this._clearIdleTimer();
    this.songs = [];
    this.currentSong = null;
    if (this.npMessage) {
      this.npMessage.delete().catch(() => {});
      this.npMessage = null;
    }
    this.textChannel = null;
    this.player.stop(true);
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
    queues.delete(this.guildId);
  }
}

module.exports = { MusicQueue, Song, formatDuration };
