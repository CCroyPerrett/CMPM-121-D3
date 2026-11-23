// The only folder allowed to import Phaser, and for one job: drawing the grid.
// Input, the HUD, sound, and the order of events all live outside it.
import Phaser from "phaser";
import type { Cell, GameEvent, GameState, Terrain } from "../../core/mod.ts";
import { itemAt, terrainAt } from "../../core/mod.ts";
import { sounds } from "../main.ts";

export const CELL_SIZE = 32;
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 600;
const WALK_MS = 120;
const BUMP_MS = 60;
const MARKER_COLOR = 0xba8f4f;
const BUMP_COLOR = 0xe0533d;
export const iteminventory = { string: 0, wood: 0, leather: 0, iron: 0 };

interface spaces {
  x: number;
  y: number;
}
const spaceswithoutitems: spaces[] = [];

const TERRAIN_COLORS: Record<Terrain, number> = {
  grass: 0xbf87ff, // 0x5d9e4a // #a86cec #487d82 #6d4276
  forest: 0xa86cec, // 0x2f6b3a
  water: 0x487d82, // 0x2d5f9e
  rock: 0x6d4276, // 0x6e6a66
};

// Enough cells to cover the view, plus a margin so that the camera can lag behind
// the player without showing an unpainted edge.
const CELLS_ACROSS = 16;
const CELLS_DOWN = 13;

function cellCenter({ x, y }: Cell): Cell {
  return {
    x: x * CELL_SIZE + CELL_SIZE / 2,
    y: y * CELL_SIZE + CELL_SIZE / 2,
  };
}

// One output of the presenter. It shows events; it decides nothing.
// Humble Object: http://xunitpatterns.com/Humble%20Object.html
export class GridView extends Phaser.Scene {
  private readonly seed: number;
  private readonly start: Cell;
  private ground!: Phaser.GameObjects.Graphics;
  private marker!: Phaser.GameObjects.Rectangle;

  constructor(state: GameState) {
    super("grid");
    this.seed = state.seed;
    this.start = { ...state.player };
  }

  create() {
    this.ground = this.add.graphics();
    const { x, y } = cellCenter(this.start);
    this.marker = this.add.rectangle(
      x,
      y,
      CELL_SIZE,
      CELL_SIZE,
      MARKER_COLOR,
    );
    this.cameras.main.startFollow(this.marker, true, 0.2, 0.2);
    this.drawCellsAround(this.start);
    this.fitToDisplay();
  }

  // Phaser has no device-pixel setting of its own. So the canvas backing store is
  // CSS size times devicePixelRatio, the CSS size stays put, and a camera zoom lets
  // all drawing stay in logical pixels. The media query fires when the ratio changes:
  // a move to another monitor, or browser zoom. The view's CSS size is fixed, so plain
  // window resizes need nothing here.
  private fitToDisplay() {
    const ratio = globalThis.devicePixelRatio || 1;
    this.scale.resize(
      Math.round(VIEW_WIDTH * ratio),
      Math.round(VIEW_HEIGHT * ratio),
    );
    this.scale.canvas.style.width = `${VIEW_WIDTH}px`;
    this.scale.canvas.style.height = `${VIEW_HEIGHT}px`;
    this.cameras.main.setZoom(ratio);
    matchMedia(`(resolution: ${ratio}dppx)`).addEventListener(
      "change",
      () => this.fitToDisplay(),
      { once: true },
    );
  }

  show(event: GameEvent): Promise<void> {
    switch (event.type) {
      case "moved":
        this.drawCellsAround(event.to);
        return this.walk(event.to);
      case "blocked":
        return this.bump(event.at, event.toward);
      case "gathered":
        return Promise.resolve();
      case "empty":
        return Promise.resolve();
      default:
        // A new event type fails to type-check here until it has a presentation.
        event satisfies never;
        return Promise.resolve();
    }
  }

  private walk(to: Cell): Promise<void> {
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        ...cellCenter(to),
        duration: WALK_MS,
        onComplete: () => done(),
      });
    });
  }

  // Lurch part of the way toward the blocked cell, flash, and come back.
  private bump(at: Cell, toward: Cell): Promise<void> {
    const start = cellCenter(at);
    const target = cellCenter(toward);
    this.marker.setFillStyle(BUMP_COLOR);
    return new Promise((done) => {
      this.tweens.add({
        targets: this.marker,
        x: start.x + (target.x - start.x) * 0.3,
        y: start.y + (target.y - start.y) * 0.3,
        duration: BUMP_MS,
        yoyo: true,
        onComplete: () => {
          this.marker.setFillStyle(MARKER_COLOR);
          done();
        },
      });
    });
  }

  // Paint only what is near the camera. Asking the core again costs little, and
  // the world itself is never stored.
  private drawCellsAround({ x: centerX, y: centerY }: Cell) {
    this.ground.clear();
    for (let y = centerY - CELLS_DOWN; y <= centerY + CELLS_DOWN; y++) {
      for (let x = centerX - CELLS_ACROSS; x <= centerX + CELLS_ACROSS; x++) {
        this.ground.fillStyle(TERRAIN_COLORS[terrainAt(this.seed, x, y)]);
        this.ground.fillRect(
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE - 1,
          CELL_SIZE - 1,
        );
        if (itemAt(this.seed, x, y)) {
          //items spawn at different rates depending on terrain type
          const type = terrainAt(this.seed, x, y);
          let statement: boolean = false;
          if (type == "grass") statement = x % 7 == 0 && y % 6 == 0;
          if (type == "forest") statement = x % 6 == 0 && y % 5 == 0;
          if (type == "water") statement = x % 5 == 0 && y % 4 == 0;
          if (type == "rock") statement = x % 4 == 0 && y % 3 == 0;

          if (statement) {
            //doesn't spawn the item if its already collected
            let collected = false;
            for (let i = 0; i < spaceswithoutitems.length; i++) {
              if (
                spaceswithoutitems[i].x == x && spaceswithoutitems[i].y == y
              ) {
                collected = true;
                break;
              }
            }

            const currentterrain = terrainAt(this.seed, x, y);
            if (collected == false) {
              //if were on the space with an item, collect it and mark it as collected
              if (x == centerX && y == centerY) {
                sounds.play("unlock");
                spaceswithoutitems.push({ x: x, y: y });
                if (currentterrain == "grass") {
                  iteminventory.string += 1;
                } else if (currentterrain == "forest") {
                  iteminventory.wood += 1;
                } else if (currentterrain == "water") {
                  iteminventory.leather += 1;
                } else if (currentterrain == "rock") {
                  iteminventory.iron += 1;
                }
              }

              if (currentterrain == "grass") {
                this.ground.fillStyle(0xD3D3D3);
              } else if (currentterrain == "forest") {
                this.ground.fillStyle(0x8B4513);
              } else if (currentterrain == "water") {
                this.ground.fillStyle(0xFFB6C1);
              } else if (currentterrain == "rock") {
                this.ground.fillStyle(0x00008B);
              }

              this.ground.fillTriangle(
                x * CELL_SIZE + CELL_SIZE * 0.2,
                y * CELL_SIZE + CELL_SIZE * 0.8,
                x * CELL_SIZE + CELL_SIZE * 0.8,
                y * CELL_SIZE + CELL_SIZE * 0.8,
                x * CELL_SIZE + CELL_SIZE * 0.5,
                y * CELL_SIZE + CELL_SIZE * 0.3,
              );
            }
          }
        }
      }
    }
  }
}

// Resolves once Phaser has booted and the scene exists. Phaser's input and audio
// are off: this project only asks it to draw.
export function startGridView(
  parent: HTMLElement,
  state: GameState,
): Promise<GridView> {
  return new Promise((ready) => {
    const view = new GridView(state);
    new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      backgroundColor: "#14161a",
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scene: view,
      callbacks: {
        postBoot: () => ready(view),
      },
    });
  });
}
