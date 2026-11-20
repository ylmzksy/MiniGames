/**
 * Shared countdown with a shrinking time bar, for games played against time.
 * The clock pauses while the page is hidden or a dialog (info, level picker) is open.
 *
 *   const timer = new Countdown(document.getElementById('timer'));
 *   timer.reset(30);                     // full bar, not running
 *   timer.start(30, () => { ... });      // runs; the callback fires when time is up
 *   const left = timer.stop();           // seconds left
 */
class Countdown {
    constructor(el) {
        this.el = el;
        el.classList.add('timebar');
        el.innerHTML = '<div class="timebar-track"><div class="timebar-fill"></div></div><span class="timebar-text"></span>';
        this.fill = el.querySelector('.timebar-fill');
        this.text = el.querySelector('.timebar-text');
        this.total = 0;
        this.left = 0;
        this.interval = null;
        window.addEventListener('langChanged', () => this.render());
        this.render();
    }

    reset(seconds) {
        this.stop();
        this.total = this.left = seconds * 1000;
        this.render();
    }

    start(seconds, onExpire) {
        this.reset(seconds);
        this.onExpire = onExpire;
        this.last = performance.now();
        this.interval = setInterval(() => this.tick(), 100);
        this.render();
    }

    tick() {
        const now = performance.now();
        // Small steps only, so time spent in a background tab is not counted
        const dt = Math.min(now - this.last, 250);
        this.last = now;
        if (document.hidden || document.querySelector('.modal.active')) return;
        this.left = Math.max(0, this.left - dt);
        this.render();
        if (this.left === 0) {
            this.stop();
            if (this.onExpire) this.onExpire();
        }
    }

    stop() {
        clearInterval(this.interval);
        this.interval = null;
        this.render();
        return this.left / 1000;
    }

    isRunning() {
        return this.interval !== null;
    }

    render() {
        const share = this.total ? this.left / this.total : 0;
        this.fill.style.width = `${share * 100}%`;
        this.text.innerText = `${Math.ceil(this.left / 1000)} ${i18n.t('seconds_short')}`;
        this.el.classList.toggle('low', this.isRunning() && share < 0.25);
    }
}
