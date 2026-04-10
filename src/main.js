import './style.css';
import { Game } from './game.js';
import { loadSave } from './progression.js';

loadSave();
const game = new Game();
game.start();
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('touchstart', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });
