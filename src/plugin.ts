import streamDeck from "@elgato/streamdeck";
import { ClaudeAction } from "./actions/claudeAction.js";
import { CodexAction } from "./actions/codexAction.js";
import { CpuAction } from "./actions/cpuAction.js";
import { RamAction } from "./actions/ramAction.js";
import { SlackAction } from "./actions/slackAction.js";

streamDeck.actions.registerAction(new ClaudeAction());
streamDeck.actions.registerAction(new CodexAction());
streamDeck.actions.registerAction(new CpuAction());
streamDeck.actions.registerAction(new RamAction());
streamDeck.actions.registerAction(new SlackAction());

streamDeck.connect();
