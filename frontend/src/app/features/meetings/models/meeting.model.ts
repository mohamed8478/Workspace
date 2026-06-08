import { Participant } from "./participant.model";

export interface Meeting {

  id: number;

  title: string;

  startTime?: string;

  description?: string;

  participants: Array<Participant>
}