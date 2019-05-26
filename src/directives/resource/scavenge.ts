// Scavengeing directive: spawns scavengeer creeps to move large amounts of resourecs from a location (e.g. draining a storage)

import {Directive} from '../Directive';
import {profile} from '../../profiler/decorator';
import {isStoreStructure, isMineralStructure, isEnergyStructure} from '../../declarations/typeGuards';
import {ScavengingOverlord} from '../../overlords/situational/scavenger';
import { Visualizer } from 'visuals/Visualizer';


interface DirectiveScavengeMemory extends FlagMemory {
	totalResources?: number;
}

@profile
export class DirectiveScavenge extends Directive {

	static directiveName = 'scavenge';
	static color = COLOR_GREY;
	static secondaryColor = COLOR_PURPLE;
	room: Room;
	private _drops:  Resource[] ;

	targetStoreStructure: StructureStorage | StructureTerminal | StructureNuker | StructureLab | StructureTower | StructureExtension | StructureSpawn| undefined;

	targetStore: StoreDefinition;
	memory: DirectiveScavengeMemory;
	targetRampart: StructureRampart;

	totalAvailableResources: number;

	constructor(flag: Flag) {
		super(flag);
		this.totalAvailableResources = 0;
	}

	spawnMoarOverlords() {
		this.overlords.scavenge = new ScavengingOverlord(this);
	}

	get drops(): Resource[] {
		if (!this.pos.isVisible) {
			return [];
		}
		if (!this._drops) {
			let drops = (this.room.find(FIND_DROPPED_RESOURCES) || []) as Resource[];
			this._drops = drops;
		}
		return this._drops;
	}

	get hasDrops(): boolean {
		return this.drops.length > 0;
	}

	refresh(): void{
		if (!this.pos.isVisible) return;

		let storeTypes = [STRUCTURE_NUKER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN] as StructureConstant[];
		let structures = this.room.find(FIND_STRUCTURES) as Structure[];
		let bestAmount = 0 as number;
		let bestRamparedAmount = 0 as number;
		this.totalAvailableResources = 0;

		for (let structure of structures) {
			for (let storeType of storeTypes) {
				if (structure.structureType == storeType) {

					let store: { [resourceType: string]: number } = {};
					if (structure) {
						if (isStoreStructure(structure)) {
							store = structure.store;
						}else {
							if(isEnergyStructure(structure)){
								store['energy'] = structure.energy;
							}
							if(isMineralStructure(structure)){
								store[structure.mineralType] = structure.mineralAmount;
							} 
						}
					}

					if(store == {}){
						store = { 'energy': 0 };
					}
					// Merge with drops
					let totalAmount = 0;


					for (let resourceType of _.keys(store)) {
						totalAmount += store[resourceType];
					}


					let rampart = structure.pos.lookForStructure(STRUCTURE_RAMPART) as StructureRampart;
					if (rampart && !rampart.my) {
						if(bestRamparedAmount > totalAmount){
							continue;
						}
						bestRamparedAmount = totalAmount;
						this.targetRampart = rampart;
					} else {
						this.totalAvailableResources += totalAmount;
						if(bestAmount > totalAmount){
							continue;
						}
						bestAmount = totalAmount;
				
						this.targetStore = store as StoreDefinition;
						this.targetStoreStructure = structure as StructureStorage | StructureTerminal | StructureNuker | StructureLab | StructureTower | StructureExtension | StructureSpawn;
					}
				}
			}
		}

		this.totalAvailableResources += _.sum(this.drops, d => d.amount);	
	}

	init(): void {
		this.alert(`Scavenge directive active`);
		if (!this.pos.isVisible) return;

		let storeTypes = [STRUCTURE_NUKER, STRUCTURE_STORAGE, STRUCTURE_TERMINAL, STRUCTURE_LAB, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN] as StructureConstant[];
		let structures = this.room.find(FIND_STRUCTURES) as Structure[];
		let bestAmount = 0 as number;
		let bestRamparedAmount = 0 as number;
		this.totalAvailableResources = 0;

		for (let structure of structures) {
			for (let storeType of storeTypes) {
				if (structure.structureType == storeType) {

					let store: { [resourceType: string]: number } = {};
					if (structure) {
						if (isStoreStructure(structure)) {
							store = structure.store;
						}else {
							if(isEnergyStructure(structure)){
								store['energy'] = structure.energy;
							}
							if(isMineralStructure(structure)){
								store[structure.mineralType] = structure.mineralAmount;
							} 
						}
					}

					if(store == {}){
						store = { 'energy': 0 };
					}
					// Merge with drops
					let totalAmount = 0;


					for (let resourceType of _.keys(store)) {
						totalAmount += store[resourceType];
					}


					let rampart = structure.pos.lookForStructure(STRUCTURE_RAMPART) as StructureRampart;
					if (rampart && !rampart.my) {
						if(bestRamparedAmount > totalAmount){
							continue;
						}
						bestRamparedAmount = totalAmount;
						this.targetRampart = rampart;
					} else {
						this.totalAvailableResources += totalAmount;
						if(bestAmount > totalAmount){
							continue;
						}
						bestAmount = totalAmount;
				
						this.targetStore = store as StoreDefinition;
						this.targetStoreStructure = structure as StructureStorage | StructureTerminal | StructureNuker | StructureLab | StructureTower | StructureExtension | StructureSpawn;
					}
				}
			}
		}

		this.totalAvailableResources += _.sum(this.drops, d => d.amount);	
	}

	run(): void {
		if (this.pos.isVisible && !this.targetRampart && (this.totalAvailableResources <= 0)) {
			this.remove();
		}
	}

	visuals(): void{
		if(this.targetRampart){
			Visualizer.marker(this.targetRampart.pos, {color: 'purple'});
		}

		if(this.targetStoreStructure) {
			Visualizer.marker(this.targetStoreStructure.pos, {color: 'cyan'});
		} 
		
		if(this.hasDrops){
			Visualizer.marker((this.drops[0] as Resource).pos, {color: 'yellow'});
		}
	}

}

