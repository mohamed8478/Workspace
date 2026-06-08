import { inject, Injectable, signal, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { UserSearchResult } from "../../../shared/models";
import { UsersApiService } from "../../../api/users-api.service";
import { Participant } from "../models/participant.model";
import { Meeting } from "../models/meeting.model";

@Injectable({
    providedIn: 'root'
})
export class MeetingService {

    private readonly userApi = inject(UsersApiService);
    private readonly destroyRef = inject(DestroyRef);
    readonly users = signal<UserSearchResult[]>([]);
    readonly participants = signal<Participant[]>([]);
    readonly meetings = signal<Meeting[]>([]);





    findUser(query: string): void {
        if (!query) {
            this.users.set([]);
            return;
        }
        this.userApi.searchUsers(query)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(results => {
                this.users.set(results);
            });
    }


    formatDate(dateStr: string): { dayLabel: string; monthLabel: string } {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === tomorrow.toDateString();

        if (isToday) return { dayLabel: 'Today', monthLabel: '' };
        if (isTomorrow) return { dayLabel: 'Tomorrow', monthLabel: '' };

        const day = date.getDate().toString();
        const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase(); // "MAY"

        return { dayLabel: day, monthLabel: month };
    }


    formatTime(dateStr: string): string {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true  // "09:00 AM"
        });}


        addParticipant(participant: UserSearchResult): void {
            const exists = this.participants().some(p => p.id === participant.id);
            if(exists) return;
            const newParticipant: Participant = {
                id: participant.id,
                name: participant.fullName,
            };
            this.participants.update(current => [...current, newParticipant]);
        }

        removeParticipant(participantId: number): void {
            this.participants.update(current =>
                current.filter(p => p.id !== participantId)
            );
        }

    }