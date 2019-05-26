import {Task} from '../Task';
import {profile} from '../../profiler/decorator';


export type scavengeTargetType = Structure;
export const scavengeTaskName = 'scavenge';

@profile
export class TaskScavenge extends Task {
	target: scavengeTargetType;

	constructor(target: scavengeTargetType, options = {} as TaskOptions) {
		super(scavengeTaskName, target, options);
		this.settings.timeout = 100;
	}

	isValidTask() {
		return (this.creep.getActiveBodyparts(WORK) > 0 && _.sum(this.creep.carry) < this.creep.carryCapacity);
	}

	isValidTarget() {
		return this.target && this.target.hits > 0;
	}

	work() {
		return this.creep.dismantle(this.target);
	}
}
