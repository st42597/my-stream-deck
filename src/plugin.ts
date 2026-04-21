import streamDeck from "@elgato/streamdeck";
import { ClaudeAction } from "./actions/claudeAction.js";
import { CodexAction } from "./actions/codexAction.js";
import { CpuAction } from "./actions/cpuAction.js";
import { RamAction } from "./actions/ramAction.js";
import { SlackAction } from "./actions/slackAction.js";
import { ClaudeSessionAction } from "./actions/claudeSessionAction.js";
import { PokerAction } from "./actions/pokerAction.js";

streamDeck.actions.registerAction(new ClaudeAction());
streamDeck.actions.registerAction(new CodexAction());
streamDeck.actions.registerAction(new CpuAction());
streamDeck.actions.registerAction(new RamAction());
streamDeck.actions.registerAction(new SlackAction());
streamDeck.actions.registerAction(new ClaudeSessionAction());
streamDeck.actions.registerAction(new PokerAction());

streamDeck.connect();
