import streamDeck, { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { drawCards, renderPokerSvg, PokerCard } from "../utils/renderPoker.js";
import { svgToDataUrl } from "../utils/svgUtils.js";

interface PokerSettings {
  [key: string]: JsonValue;
}

@action({ UUID: "com.sh.aitoken.poker" })
export class PokerAction extends SingletonAction<PokerSettings> {
  private cards: [PokerCard, PokerCard] | null = null;

  override async onWillAppear(ev: WillAppearEvent<PokerSettings>): Promise<void> {
    streamDeck.logger.info("[PokerAction] onWillAppear");
    await this.render(ev.action);
  }

  override async onKeyDown(ev: KeyDownEvent<PokerSettings>): Promise<void> {
    this.cards = drawCards();
    streamDeck.logger.info(`[PokerAction] drew ${this.cards[0].rank}${this.cards[0].suit} ${this.cards[1].rank}${this.cards[1].suit}`);
    await this.render(ev.action);
  }

  private async render(action: WillAppearEvent<PokerSettings>["action"] | KeyDownEvent<PokerSettings>["action"]): Promise<void> {
    await action.setImage(svgToDataUrl(renderPokerSvg(this.cards)));
    await action.setTitle("");
  }
}
