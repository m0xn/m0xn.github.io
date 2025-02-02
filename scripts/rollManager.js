import { playersManager, playersUpdateEv } from "./playersManager.js";
import { stateManager } from "./stateManager.js";

export let diceRolled = false;

class Dice {
	constructor(el) {
		this.value = 0;
		this.el = el;
		this.rolling = false;
		this.rolled = false;
	}
}

const MINITERS = 10;
const MAXITERS = 35;

function handleSpeedMod(speedMod) {
	playersManager.lastSelected.speed += speedMod;
	document.dispatchEvent(playersUpdateEv);
	disableButtons();
}

function rollDice(dice, interval = 125) {
	cancelSelectionBtn.disabled = true;
	finishTurnBtn.disabled = true;
	const iters = MAXITERS - playersManager.playersInGame.length * 2 > MINITERS
		? MAXITERS - playersManager.playersInGame.length * 2
		: MINITERS;
	let completedIters = 0;
	dice.rolling = true;

	return new Promise((resolve, _) => {
		const rollingAnimID = setInterval(() => {
			const rolledNumber = Math.floor(Math.random() * 6) + 1;
			if (completedIters == iters - 1) {
				dice.rolling = false;
				dice.value = rolledNumber;
				dice.rolled = true;
				resolve(dice.value);
				if (dice.el.id == "left-dice" && rightDice.rolled
					|| dice.el.id == "right-dice" && leftDice.rolled) {
					document.dispatchEvent(finishRollEv);
					diceRolled = true;
				}
				clearInterval(rollingAnimID);
			}
			dice.el.src = `sprites/dice${rolledNumber}.png`;
			completedIters++;
		}, interval);
	})
}

const matchingSpeeds = [];

function checkForTie() {
	const c1Players = playersManager.playersInGame.filter(pl => pl.group === "c1" && pl.speed > 0);
	const c2Players = playersManager.playersInGame.filter(pl => pl.group === "c2" && pl.speed > 0).toSorted();

	for (let i = 1; i < c2Players.length && c2Players.length > 1; i++)
		if (c2Players[i].speed === c2Players[i - 1].speed) {
			matchingSpeeds.push(c2Players[i]);
			if (!matchingSpeeds.some(pl => pl === c2Players[i - 1])) matchingSpeeds.push(c2Players[i - 1]);
		}

	if (matchingSpeeds.length === 0) return false;

	const slowerPlayers = c1Players.filter(pl => pl.speed < matchingSpeeds[0].speed);

	if (slowerPlayers.length === 0 || matchingSpeeds.length < slowerPlayers.length) return false;

	const header = document.createElement("h2");
	header.innerHTML = "¡Desempate!";

	const playersPar = document.createElement("p");
	for (let i = 0; i < matchingSpeeds.length; i++) {
		playersPar.innerHTML += i < matchingSpeeds.length - 1
			? `${matchingSpeeds[i].name} VS `
			: `${matchingSpeeds[i].name}`;
	}

	tieBreakHeader.appendChild(header);
	tieBreakHeader.appendChild(playersPar);
	tieBreakHeader.style.opacity = "100%";

	playersManager.lastSelected = matchingSpeeds.shift();
	playersManager.lastSelected.selected = true;
	playersManager.lastSelected.cooperation = false;
	playersManager.lastSelected.speed = 0;

	stateManager.changeState("tie-break");
	document.dispatchEvent(playersUpdateEv);
	resetDices();
	return true;
}

function handleTieBreak() {
	playersManager.lastSelected.selected = false;
	document.dispatchEvent(playersUpdateEv);

	const nextPlayer = matchingSpeeds.shift();
	if (!nextPlayer) {
		tieBreakHeader.style.opacity = "0%";
		while (tieBreakHeader.childNodes.length > 0) tieBreakHeader.removeChild(tieBreakHeader.firstChild);

		stateManager.changeState("finalResults")
		return;
	}
	playersManager.lastSelected = nextPlayer;
	playersManager.lastSelected.selected = true;
	playersManager.lastSelected.cooperation = false;
	playersManager.lastSelected.speed = 0;

	document.dispatchEvent(playersUpdateEv);
	resetDices();
	stateManager.changeState("tie-break");
}

const buttonsText = {
	coop: {
		c1: "Cooperación",
		c2: "Caza en grupo"
	},
	speedAmp: {
		c1: "Huida rápida",
		c2: "Huida rápida"
	},
	speedNerf: {
		c1: "Herida",
		c2: "Herida"
	}
}

const finishRollEv = new Event("finish-roll");
document.addEventListener("finish-roll", () => {
	finishRollBtn.disabled = false;
	finishTurnBtn.disabled = false;
});

const SPEEDBOOST = 6;
const SPEEDNERF = -2;

const speedAmpBtn = document.querySelector("button#speed-amp");
const speedNerfBtn = document.querySelector("button#speed-nerf");
const coopBtn = document.querySelector("button#coop");

const tieBreakHeader = document.querySelector("section#tie-break");

document.addEventListener("change-state", () => {
	if (stateManager.state !== "playerRoll") return;
	const group = playersManager.lastSelected.group;
	speedAmpBtn.innerHTML = buttonsText.speedAmp[group];
	coopBtn.innerHTML = buttonsText.coop[group];
	speedNerfBtn.innerHTML = buttonsText.speedNerf[group];
});

const finishRollBtn = document.querySelector("button#finish-roll");
const finishTurnBtn = document.querySelector("button#finish-turn");
const cancelSelectionBtn = document.querySelector("button#cancel-selection");

const leftDice = new Dice(document.querySelector("img#left-dice"));
const rightDice = new Dice(document.querySelector("img#right-dice"));

leftDice.el.addEventListener("click", async () => {
	if (stateManager.state !== "playerRoll" && stateManager.state !== "tie-break" || leftDice.rolled || leftDice.rolling) return;
	const diceRes = await rollDice(leftDice);
	playersManager.lastSelected.speed += diceRes;
	document.dispatchEvent(playersUpdateEv);
	if (stateManager.state === "tie-break" && rightDice.rolled) handleTieBreak();
});

rightDice.el.addEventListener("click", async () => {
	if (stateManager.state !== "playerRoll" && stateManager.state !== "tie-break" || rightDice.rolled || rightDice.rolling) return;
	const diceRes = await rollDice(rightDice);
	playersManager.lastSelected.speed += diceRes;
	document.dispatchEvent(playersUpdateEv);
	if (stateManager.state === "tie-break" && leftDice.rolled) handleTieBreak();
});

const disableButtons = () => {
	speedAmpBtn.disabled = true;
	speedNerfBtn.disabled = true;
	coopBtn.disabled = true;
}

speedAmpBtn.addEventListener("click", () => { handleSpeedMod(SPEEDBOOST); });
speedNerfBtn.addEventListener("click", () => { handleSpeedMod(SPEEDNERF); });
coopBtn.addEventListener("click", () => {
	playersManager.lastSelected.cooperation = true;
	document.dispatchEvent(playersUpdateEv);
	disableButtons();
});

const resetDices = () => {
	leftDice.rolled = false;
	rightDice.rolled = false;
	diceRolled = false;
}

finishRollBtn.addEventListener("click", () => {
	const playersInGroup = playersManager.players.filter(pl => pl.group === playersManager.lastSelected.group);
	const playersInGame = playersManager.playersInGame.filter(pl => pl.group === playersManager.lastSelected.group);
	if (playersInGroup.length !== playersInGame.length) stateManager.changeState(`${playersManager.lastSelected.group}PlayerSelect`);
	else {
		if (playersManager.lastSelected.group == "c1") stateManager.changeState("c2PlayerSelect");
		else {
			playersManager.lastSelected.selected = false;
			document.dispatchEvent(playersUpdateEv);
			if (checkForTie()) return;
			stateManager.changeState("finalResults");
		}
	}
	resetDices();
});

finishTurnBtn.addEventListener("click", () => {
	finishTurnBtn.disabled = true;
	if (playersManager.lastSelected.group === "c1") stateManager.changeState("c2PlayerSelect");
	else {
		playersManager.lastSelected.selected = false;
		document.dispatchEvent(playersUpdateEv);
		if (checkForTie()) return;
		stateManager.changeState("finalResults");
	}
	resetDices();
});

cancelSelectionBtn.addEventListener("click", () => {
	playersManager.lastSelected.selected = false;
	document.dispatchEvent(playersUpdateEv);
	playersManager.playersInGame.pop();
	stateManager.changeState(`${playersManager.lastSelected.group}PlayerSelect`);
});
