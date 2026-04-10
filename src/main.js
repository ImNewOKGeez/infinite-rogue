import './style.css';
import { Game } from './game.js';
import { loadSave } from './progression.js';

loadSave();
const game = new Game();
game.start();

function allowsNativeTouchScroll(target) {
  return target instanceof Element
    && !!target.closest('#overlay.playtest-screen, #overlay.records-screen');
}

document.addEventListener('touchmove', e => {
  if (allowsNativeTouchScroll(e.target)) return;
  e.preventDefault();
}, { passive: false });

document.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
