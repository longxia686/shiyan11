/**
 * 实验十一：定时器驱动小球沿斜坡运动（模拟重力加速）
 * 请将本文件重命名为 lab11-[学号后两位].js，并同步修改 index.html 中的 script 引用
 */
(function () {
    "use strict";

    var TICK_MS = 16;
    var GRAVITY = 0.045;
    var RESET_DELAY_MS = 600;

    function RollingSound() {
        this.ctx = null;
        this.masterGain = null;
        this.rollGain = null;
        this.noiseSource = null;
        this.filter = null;
        this.ready = false;
        this.muted = false;
        this.volume = 0.65;
        this.lastVelocity = 0;
    }

    RollingSound.prototype.ensureContext = function () {
        if (this.ready) {
            if (this.ctx.state === "suspended") {
                this.ctx.resume();
            }
            return;
        }

        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            return;
        }

        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);

        this.rollGain = this.ctx.createGain();
        this.rollGain.gain.value = 0;

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = "bandpass";
        this.filter.frequency.value = 320;
        this.filter.Q.value = 0.8;

        var buffer = this.createNoiseBuffer(2);
        this.noiseSource = this.ctx.createBufferSource();
        this.noiseSource.buffer = buffer;
        this.noiseSource.loop = true;

        this.noiseSource.connect(this.filter);
        this.filter.connect(this.rollGain);
        this.rollGain.connect(this.masterGain);
        this.noiseSource.start(0);

        this.ready = true;
    };

    RollingSound.prototype.createNoiseBuffer = function (seconds) {
        var sampleRate = this.ctx.sampleRate;
        var length = sampleRate * seconds;
        var buffer = this.ctx.createBuffer(1, length, sampleRate);
        var data = buffer.getChannelData(0);
        var last = 0;

        for (var i = 0; i < length; i++) {
            var white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 2.8;
        }

        return buffer;
    };

    RollingSound.prototype.setVolume = function (value) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
    };

    RollingSound.prototype.setMuted = function (muted) {
        this.muted = muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : this.volume;
        }
        if (!this.muted && this.ready) {
            this.update(this.lastVelocity, true);
        } else if (this.rollGain) {
            this.rollGain.gain.value = 0;
        }
    };

    RollingSound.prototype.update = function (velocity, running) {
        this.lastVelocity = velocity;
        if (!this.ready || this.muted) {
            return;
        }

        var intensity = running ? Math.min(Math.max(velocity / 2.8, 0), 1) : 0;
        var rollVol = 0.08 + intensity * 0.42;
        var freq = 180 + intensity * 520;

        this.rollGain.gain.setTargetAtTime(rollVol, this.ctx.currentTime, 0.04);
        this.filter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.06);
    };

    function BallOnRamp(options) {
        this.ball = options.ball;
        this.rampWrap = options.rampWrap;
        this.speedEl = options.speedEl;
        this.distEl = options.distEl;
        this.sound = options.sound;

        this.position = 0;
        this.velocity = 0;
        this.rollDeg = 0;
        this.maxDistance = 0;
        this.running = true;
        this.speedScale = 1;
        this.resetTimerId = null;
        this.tickTimerId = null;
    }

    BallOnRamp.prototype.measure = function () {
        var rampWidth = this.rampWrap.clientWidth;
        var ballSize = this.ball.offsetWidth;
        this.maxDistance = Math.max(rampWidth - ballSize * 0.5, 0);
    };

    BallOnRamp.prototype.updateStats = function () {
        if (this.speedEl) {
            this.speedEl.textContent = (this.velocity * this.speedScale).toFixed(2);
        }
        if (this.distEl) {
            this.distEl.textContent = Math.round(this.position);
        }
    };

    BallOnRamp.prototype.apply = function () {
        this.ball.style.left = this.position + "px";
        this.ball.style.transform = "rotate(" + this.rollDeg + "deg)";
        this.updateStats();
        if (this.sound) {
            this.sound.update(this.velocity * this.speedScale, this.running);
        }
    };

    BallOnRamp.prototype.reset = function () {
        if (this.resetTimerId !== null) {
            clearTimeout(this.resetTimerId);
            this.resetTimerId = null;
        }
        this.position = 0;
        this.velocity = 0;
        this.rollDeg = 0;
        this.apply();
    };

    BallOnRamp.prototype.scheduleReset = function () {
        var self = this;
        if (this.resetTimerId !== null) {
            return;
        }
        this.resetTimerId = setTimeout(function () {
            self.resetTimerId = null;
            self.reset();
        }, RESET_DELAY_MS / this.speedScale);
    };

    BallOnRamp.prototype.tick = function () {
        if (!this.running) {
            if (this.sound) {
                this.sound.update(0, false);
            }
            return;
        }

        var k = this.speedScale;
        this.velocity += GRAVITY * k;
        this.position += this.velocity * k;
        this.rollDeg += this.velocity * 4.2 * k;

        if (this.position >= this.maxDistance) {
            this.position = this.maxDistance;
            this.scheduleReset();
        }

        this.apply();
    };

    BallOnRamp.prototype.setSpeedScale = function (value) {
        this.speedScale = value;
    };

    BallOnRamp.prototype.start = function () {
        var self = this;
        this.measure();
        this.apply();
        this.tickTimerId = setInterval(function () {
            self.tick();
        }, TICK_MS);
    };

    BallOnRamp.prototype.pause = function () {
        this.running = false;
        this.apply();
    };

    BallOnRamp.prototype.resume = function () {
        this.running = true;
    };

    BallOnRamp.prototype.toggle = function () {
        this.running = !this.running;
        if (!this.running) {
            this.apply();
        }
        return this.running;
    };

    function bindFullscreen(stageWrap, btn) {
        function isFs() {
            return document.fullscreenElement === stageWrap ||
                document.webkitFullscreenElement === stageWrap;
        }

        function updateText() {
            btn.textContent = isFs() ? "退出全屏" : "全屏";
        }

        function enterFs() {
            if (stageWrap.requestFullscreen) {
                stageWrap.requestFullscreen();
            } else if (stageWrap.webkitRequestFullscreen) {
                stageWrap.webkitRequestFullscreen();
            }
        }

        function exitFs() {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }

        btn.addEventListener("click", function () {
            if (isFs()) {
                exitFs();
            } else {
                enterFs();
            }
        });

        document.addEventListener("fullscreenchange", updateText);
        document.addEventListener("webkitfullscreenchange", updateText);
    }

    function init() {
        var ball = document.getElementById("lab11-ball");
        var rampWrap = document.getElementById("lab11-ramp-wrap");
        var stageWrap = document.getElementById("lab11-stage-wrap");
        var speedEl = document.getElementById("lab11-speed");
        var distEl = document.getElementById("lab11-distance");
        var btnToggle = document.getElementById("lab11-toggle");
        var btnReset = document.getElementById("lab11-reset");
        var btnFullscreen = document.getElementById("lab11-fullscreen");
        var rateInput = document.getElementById("lab11-rate");
        var rateVal = document.getElementById("lab11-rate-val");
        var volumeInput = document.getElementById("lab11-volume");
        var volumeVal = document.getElementById("lab11-volume-val");
        var btnMute = document.getElementById("lab11-mute");
        var btnUnmute = document.getElementById("lab11-unmute");

        if (!ball || !rampWrap) {
            return;
        }

        var sound = new RollingSound();

        function bootAudio() {
            sound.ensureContext();
        }

        document.addEventListener("click", bootAudio, { once: true });

        var sim = new BallOnRamp({
            ball: ball,
            rampWrap: rampWrap,
            speedEl: speedEl,
            distEl: distEl,
            sound: sound
        });

        sim.start();
        bindFullscreen(stageWrap, btnFullscreen);

        window.addEventListener("resize", function () {
            sim.measure();
            if (sim.position > sim.maxDistance) {
                sim.position = sim.maxDistance;
                sim.apply();
            }
        });

        btnToggle.addEventListener("click", function () {
            bootAudio();
            var running = sim.toggle();
            btnToggle.textContent = running ? "暂停" : "继续";
        });

        btnReset.addEventListener("click", function () {
            bootAudio();
            sim.reset();
        });

        rateInput.addEventListener("input", function () {
            bootAudio();
            var rate = parseFloat(rateInput.value);
            sim.setSpeedScale(rate);
            rateVal.textContent = rate.toFixed(2).replace(/\.00$/, ".0") + "×";
        });

        volumeInput.addEventListener("input", function () {
            bootAudio();
            var vol = parseInt(volumeInput.value, 10) / 100;
            sound.setVolume(vol);
            volumeVal.textContent = volumeInput.value + "%";
        });

        btnMute.addEventListener("click", function () {
            bootAudio();
            sound.setMuted(true);
            btnMute.classList.add("is-active");
            btnUnmute.classList.remove("is-active");
        });

        btnUnmute.addEventListener("click", function () {
            bootAudio();
            sound.setMuted(false);
            btnUnmute.classList.add("is-active");
            btnMute.classList.remove("is-active");
        });

        btnUnmute.classList.add("is-active");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
