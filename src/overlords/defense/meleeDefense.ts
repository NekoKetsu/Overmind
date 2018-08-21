// archer overlord - spawns defender/healer pairs for sustained combat

import {OverlordPriority} from '../../priorities/priorities_overlords';
import {boostResources} from '../../resources/map_resources';
import {DirectiveInvasionDefense} from '../../directives/defense/invasionDefense';
import {profile} from '../../profiler/decorator';
import {CombatIntel} from '../../intel/CombatIntel';
import {CreepSetup} from '../CreepSetup';
import {Overlord} from '../Overlord';
import {CombatZerg} from '../../zerg/CombatZerg';

export const ZerglingSetup = new CreepSetup('zergling', {
	pattern  : [ATTACK, MOVE],
	sizeLimit: Infinity,
});

export const ArmoredZerglingSetup = new CreepSetup('zergling', {
	pattern  : [TOUGH, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE],
	sizeLimit: Infinity,
});

@profile
export class MeleeDefenseOverlord extends Overlord {

	zerglings: CombatZerg[];
	// private defendPositions: RoomPosition[];
	room: Room;

	static settings = {
		retreatHitsPercent : 0.75,
		reengageHitsPercent: 0.95,
	};

	constructor(directive: DirectiveInvasionDefense, boosted = false, priority = OverlordPriority.defense.meleeDefense) {
		super(directive, 'meleeDefense', priority);
		this.zerglings = _.map(this.creeps(ZerglingSetup.role), creep => new CombatZerg(creep));
		if (boosted) {
			this.boosts[ZerglingSetup.role] = [
				boostResources.tough[3],
				boostResources.attack[3],
			];
		}
		// let rampartPositions = _.map(_.filter(this.colony.room.barriers, s => s.structureType == STRUCTURE_RAMPART),
		// 							 barrier => barrier.pos);
		// this.defendPositions = _.filter(rampartPositions,
		// 								pos => pos.findInRange(this.colony.room.hostiles, 1).length > 1);
	}

	// private retreatActions(defender: CombatZerg): void {
	// 	if (defender.hits > MeleeDefenseOverlord.settings.reengageHitsPercent * defender.hits) {
	// 		defender.memory.retreating = false;
	// 	}
	// 	// Find a safe position and retreat
	// 	let retreatRampart = defender.pos.findClosestByRange(_.filter(this.room.ramparts,
	// 																  rampart => rampart.pos.isWalkable()));
	// 	if (retreatRampart) {
	// 		defender.goTo(retreatRampart);
	// 	} else {
	// 		log.error('No retreat ramparts!');
	// 	}
	// }

	// private handleDefender(defender: CombatZerg): void {
	// 	// // Move to a defensible position
	// 	// let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
	// 	// if (!isStandingInDefensePos) {
	// 	// 	let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
	// 	// 	let target = defender.pos.findClosestByRange(availablePositions);
	// 	// 	if (target) {
	// 	// 		let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
	// 	// 		defender.goTo(target, {obstacles: enemyPositions, movingTarget: true});
	// 	// 	}
	// 	// }
	// 	// // Attack something
	// 	// let target = this.findClosestHostile(defender, false, false);
	// 	// if (target && defender.pos.isNearTo(target)) {
	// 	// 	defender.attack(target);
	// 	// }
	//
	// 	// Get a target
	// 	let adjacentHostiles = _.filter(this.room.hostiles, creep => defender.pos.getRangeTo(creep.pos) == 1);
	// 	let target: Creep | undefined;
	// 	if (adjacentHostiles.length > 1) {
	// 		target = minBy(adjacentHostiles, (hostile: Creep) => CombatIntel.maxHostileHealingTo(hostile));
	// 	} else {
	// 		target = CombatTargeting.findClosestHostile(defender, false, false);
	// 	}
	// 	// Attack something
	// 	if (target && defender.pos.isNearTo(target)) {
	// 		defender.attack(target);
	// 	}
	// 	// Move to a defensible position if there is one; else, engage target directly
	// 	let isStandingInDefensePos = _.any(this.defendPositions, pos => pos.isEqualTo(defender.pos));
	// 	if (!isStandingInDefensePos) {
	// 		let availablePositions = _.filter(this.defendPositions, pos => pos.lookFor(LOOK_CREEPS).length == 0);
	// 		let moveToDefensePos = defender.pos.findClosestByRange(availablePositions);
	// 		if (moveToDefensePos) {
	// 			let enemyPositions = _.map(this.room.hostiles, hostile => hostile.pos);
	// 			defender.goTo(moveToDefensePos, {obstacles: enemyPositions, movingTarget: true});
	// 		} else {
	// 			// Activate retreat condition if necessary
	// 			if (defender.hits < GuardPairOverlord.settings.retreatHitsPercent * defender.hitsMax) {
	// 				defender.memory.retreating = true;
	// 			}
	// 			// Either retreat to healing position or engage target
	// 			if (defender.memory.retreating) {
	// 				this.retreatActions(defender); // Retreat to fallback position
	// 			} else {
	// 				if (target) {
	// 					defender.goTo(target);
	// 				}
	// 			}
	// 		}
	// 	}
	// }

	private handleDefender(zergling: CombatZerg): void {
		if (zergling.room.hostiles.length > 0) {
			zergling.autoCombat(zergling.room.name);
		}
	}

	init() {
		this.reassignIdleCreeps(ZerglingSetup.role);
		let healPotential = CombatIntel.maxHealingByCreeps(this.room.hostiles);
		let zerglingDamage = ATTACK_POWER * ZerglingSetup.getBodyPotential(ATTACK, this.colony);
		let towerDamage = this.room.hostiles[0] ? CombatIntel.towerDamageAtPos(this.room.hostiles[0].pos) || 0 : 0;
		let worstDamageMultiplier = _.min(_.map(this.room.hostiles, creep => CombatIntel.minimumDamageTakenMultiplier(creep)));
		let boosts = this.boosts[ZerglingSetup.role];
		if (boosts && boosts.includes(boostResources.attack[3])) { // TODO: add boost damage computation function to Overlord
			zerglingDamage *= 4;
		}
		// Match the hostile damage times some multiplier
		let amount = Math.ceil(.5 + 1.5 * healPotential / (worstDamageMultiplier * (zerglingDamage + towerDamage)));
		if (this.colony.level >= 3) {
			this.wishlist(amount, ArmoredZerglingSetup);
		} else {
			this.wishlist(amount, ZerglingSetup);
		}
		this.requestBoosts(this.zerglings);
	}

	run() {
		this.autoRunCombat(this.zerglings, zergling => this.handleDefender(zergling));
	}
}
