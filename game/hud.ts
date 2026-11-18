import { type GameEvent, type GameState, terrainAt } from "../core/mod.ts";
import { iteminventory } from "./grid/grid_view.ts";
import { sounds } from "./main.ts";

export let hasboat = false;
export let hasboots = false;
export let hascompass = false;

let knowboat = false;
let knowboots = false;
let knowcompass = false;

function element(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function describe(event: GameEvent): string {
  switch (event.type) {
    case "moved":
      return `moved to ${event.to.x}, ${event.to.y}`;
    case "blocked":
      return `blocked by ${event.terrain} at ${event.toward.x}, ${event.toward.y}`;
  }
}

// The readout, as ordinary page elements that CSS can style and that assistive
// tools can read. It changes only as events play.
export class Hud {
  private readonly seed: number;

  constructor(state: GameState) {
    this.seed = state.seed;
    this.showPosition(state.player.x, state.player.y);
  }

  show(event: GameEvent) {
    element("live").textContent = describe(event);
    if (event.type === "moved") this.showPosition(event.to.x, event.to.y);
  }

  private showPosition(x: number, y: number) {
    element("position").textContent = `${x}, ${y}`;
    element("terrain").textContent = terrainAt(this.seed, x, y);
    this.updateInventory();

    //craftable boat
    if (iteminventory.wood > 0 && knowboat == false) {
      const button = document.createElement("button");
      button.textContent = "Craft Boat (1 string, 2 wood)";
      button.addEventListener("click", () => {
        if (iteminventory.wood >= 2 && iteminventory.string >= 1) {
          iteminventory.wood -= 2;
          iteminventory.string -= 1;
          hasboat = true;
          this.updateItems();
          this.updateInventory();
          sounds.play("chime");
        }
      });
      element("recipies").appendChild(button);
      knowboat = true;
    }
    if (iteminventory.leather > 0 && knowboots == false) {
      const button = document.createElement("button");
      button.textContent = "Craft Boots (2 string, 3 leather)";
      button.addEventListener("click", () => {
        if (iteminventory.string >= 2 && iteminventory.leather >= 3) {
          iteminventory.leather -= 3;
          iteminventory.string -= 2;
          hasboots = true;
          this.updateItems();
          this.updateInventory();
          sounds.play("chime");
        }
      });
      element("recipies").appendChild(button);
      knowboots = true;
    }
    if (iteminventory.iron > 0 && knowcompass == false) {
      const button = document.createElement("button");
      button.textContent = "Craft Compass Home (1 string, 1 leather, 3 iron)";
      button.addEventListener("click", () => {
        if (
          iteminventory.string >= 1 && iteminventory.leather >= 1 &&
          iteminventory.iron >= 3
        ) {
          iteminventory.leather -= 1;
          iteminventory.string -= 1;
          iteminventory.iron -= 3;
          hascompass = true;
          this.updateItems();
          this.updateInventory();
          sounds.play("chime");
        }
      });
      element("recipies").appendChild(button);
      knowcompass = true;
    }

    this.updateItems();
  }

  private updateItems() {
    let tooltxt = "";
    if (hasboat) tooltxt = tooltxt + "Wooden Boat, ";
    if (hasboots) tooltxt = tooltxt + "Leather Hiking Boots, ";
    if (hascompass) tooltxt = tooltxt + "Compass Home, ";
    element("tools").textContent = tooltxt;
  }

  private updateInventory() {
    element("inventory").textContent = "String: " + iteminventory.string +
      ", Wood: " + iteminventory.wood + ", Leather: " + iteminventory.leather +
      ", Iron: " + iteminventory.iron;
  }
}
