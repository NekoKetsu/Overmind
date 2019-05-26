import { Overlord } from '../Overlord';
import { OverlordPriority } from '../../priorities/priorities_overlords';
import { Zerg } from '../../zerg/Zerg';
import { Tasks } from '../../tasks/Tasks';
import { isStoreStructure, isEnergyStructure, isMineralStructure } from '../../declarations/typeGuards';
import { log } from '../../console/log';
import { Pathing } from '../../movement/Pathing';
import { Energetics } from '../../logistics/Energetics';
import { profile } from '../../profiler/decorator';
import { Roles, Setups } from '../../creepSetups/setups';
import { DirectiveScavenge } from 'directives/resource/scavenge';


@profile
export class ScavengingOverlord extends Overlord {

	scavengers: Zerg[];
	haulers: Zerg[];
	directive: DirectiveScavenge;

	requiredRCL: 4;

	constructor(directive: DirectiveScavenge, priority = OverlordPriority.collection.scavenge) {
		super(directive, 'scavenge', priority);
		this.directive = directive;
		this.scavengers = this.zerg(Roles.scavenger);
		this.haulers = this.zerg(Roles.scavengeTransport);
	}

	init() {
		if (!this.colony.storage || _.sum(this.colony.storage.store) > Energetics.settings.storage.total.cap) {
			return;
		}
		// Spawn a number of scanvengers
		let MAX_DISMANTLERS = 3;
		let numScavengers = (this.directive.targetRampart ? MAX_DISMANTLERS : 0);
		this.wishlist(numScavengers, Setups.scavengers.scavenger);

		// Spawn a number of haulers sufficient to move all resources within a lifetime, up to a max
		if(this.directive.totalAvailableResources){
			let MAX_HAULERS = 5;
			// Calculate total needed amount of hauling power as (resource amount * trip distance)
			let tripDistance = 2 * Pathing.distance((this.colony.storage || this.colony).pos, this.directive.pos);

			let haulingPowerNeeded = Math.min(this.directive.totalAvailableResources,
											this.colony.storage.storeCapacity
											- _.sum(this.colony.storage.store)) * tripDistance;

			// Calculate amount of hauling each hauler provides in a lifetime
			let haulerCarryParts = Setups.scavengers.hauler.getBodyPotential(CARRY, this.colony);

			let haulingPowerPerLifetime = CREEP_LIFE_TIME * haulerCarryParts * CARRY_CAPACITY;
			// Calculate number of haulers
			let numHaulers = Math.min(Math.ceil(haulingPowerNeeded / haulingPowerPerLifetime), MAX_HAULERS);
			// Request the haulers
			this.wishlist(numHaulers, Setups.scavengers.hauler);
		} else if(this.directive.hasDrops){
			this.wishlist(1, Setups.scavengers.hauler);
		}
	}

	run() {

		for (let hauler of this.haulers) {
			if (hauler.isIdle) {
				this.handleHauler(hauler);
			}
			hauler.run();
		}
		for (let scavenger of this.scavengers) {
			if (scavenger.isIdle) {
				this.handleScavenger(scavenger);
			}
			scavenger.run();
		}


	}
	handleScavenger(scavenger: Zerg) {

		if (_.sum(scavenger.carry) < scavenger.carryCapacity ) {
			if(this.directive.targetRampart){
				scavenger.task = Tasks.scavenge(this.directive.targetRampart);
				return;
			} else{
				scavenger.task = Tasks.goToRoom(this.directive.pos.roomName);
				return;
			}
		} else {
			scavenger.task = Tasks.drop(scavenger.pos);
			return;
			
		}
	}


	private handleHauler(hauler: Zerg) {
		if (_.sum(hauler.carry) < hauler.carryCapacity) {
			// Travel to directive and collect resources
			if (hauler.inSameRoomAs(this.directive)) {
				// Pick up drops first
				if (this.directive.hasDrops) {
					let allDrops: Resource[] = this.directive.drops;
					let drop = hauler.pos.findClosestByRange(allDrops);
					if (drop) {
						hauler.task = Tasks.pickup(drop);
						return;
					}
				}
				// Withdraw from store structure
				if (this.directive.targetStoreStructure) {
					let store: { [resourceType: string]: number } = {};
					if (isStoreStructure(this.directive.targetStoreStructure)) {
						store = this.directive.targetStoreStructure.store;
					} else {
						if(isEnergyStructure(this.directive.targetStoreStructure)){
							store['energy'] = this.directive.targetStoreStructure.energy;
						}
						if(isMineralStructure(this.directive.targetStoreStructure)){
							store[this.directive.targetStoreStructure.mineralType] = this.directive.targetStoreStructure.mineralAmount;
						}
					}
					for (let resourceType in store) {
						if (store[resourceType] > 0) {
							hauler.task = Tasks.withdraw(this.directive.targetStoreStructure, <ResourceConstant>resourceType);
							return;
						}
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nothing to collect!`);
			} else {
				// hauler.task = Tasks.goTo(this.directive);
				hauler.goTo(this.directive);
			}
		} else {
			// Travel to colony room and deposit resources
			if (hauler.inSameRoomAs(this.colony)) {
				// Put energy in storage and minerals in terminal if there is one
				for (let resourceType in hauler.carry) {
					if (hauler.carry[<ResourceConstant>resourceType] == 0) continue;
					if (resourceType == RESOURCE_ENERGY) { // prefer to put energy in storage
						if (this.colony.storage && _.sum(this.colony.storage.store) < STORAGE_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.storage, resourceType);
							return;
						} else if (this.colony.terminal && _.sum(this.colony.terminal.store) < TERMINAL_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.terminal, resourceType);
							return;
						}
					} else { // prefer to put minerals in terminal
						if (this.colony.terminal && _.sum(this.colony.terminal.store) < TERMINAL_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.terminal, <ResourceConstant>resourceType);
							return;
						} else if (this.colony.storage && _.sum(this.colony.storage.store) < STORAGE_CAPACITY) {
							hauler.task = Tasks.transfer(this.colony.storage, <ResourceConstant>resourceType);
							return;
						}
					}
				}
				// Shouldn't reach here
				log.warning(`${hauler.name} in ${hauler.room.print}: nowhere to put resources!`);
			} else {
				hauler.task = Tasks.goToRoom(this.colony.room.name);
			}
		}
	}

}