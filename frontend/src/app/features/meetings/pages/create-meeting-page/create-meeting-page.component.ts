import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MeetingService } from '../../services/meeting.service';
import { UserSearchResult } from '../../../../shared/models';
import { MeetingApiService, MeetingRequest } from '../../services/meeting.api.service';



@Component({
  selector: 'app-create-meeting-page',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './create-meeting-page.component.html',
  styleUrl: './create-meeting-page.component.css'
})
export class CreateMeetingPageComponent {
  private readonly meetingService = inject(MeetingService);
  private meetingApiService = inject(MeetingApiService);
  readonly users = this.meetingService.users;
  readonly participants = this.meetingService.participants;
  readonly searchValue = signal('');
  private router = inject(Router);

  meetingForm = new FormGroup({
    title : new FormControl(''),
    date: new FormControl(new Date().toISOString().split('T')[0]),
    startTime: new FormControl(new Date().toTimeString().slice(0, 5)),
    description: new FormControl('')
  });

  combinedDateTime = computed(() => {
    const date = this.meetingForm.get('date')?.value;
    const startTime = this.meetingForm.get('startTime')?.value;

    return `${date}T${startTime}`;
  });


  onSearchChange(event: Event): void {

    const target = event.target as HTMLInputElement;
    const value = target.value.trim().toLowerCase();

    this.searchValue.set(value);
    this.meetingService.findUser(value);
  }


  searchControl = new FormControl('');
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  addParticipant(user: UserSearchResult) {
    this.meetingService.addParticipant(user);
    this.searchControl.reset();           // clears the input
    this.searchValue.set('');             // clears the signal
    this.meetingService.findUser(''); 
    this.searchInput.nativeElement.focus(); // keeps cursor in input

  }

  removeParticipant(participantId: number) {
    this.meetingService.removeParticipant(participantId);
  }


// partsId = computed(()=>this.participants().map((p)=> p.id));

//   onSubmit(): void {
//     console.log('title:', this.meetingForm.value.title);
//     console.log('Date:', this.meetingForm.value.date);
//     console.log('Start Time:', this.meetingForm.value.startTime);
//     console.log('Combined ISO:', this.combinedDateTime());
//     console.log('description', this.meetingForm.value.description);
//     console.log("participants " ,this.partsId() );
//   }

onSubmit(): void {
  const payload: MeetingRequest = {
    title: this.meetingForm.value.title!,
    startTime: this.combinedDateTime(),
    description: this.meetingForm.value.description!,
    participantsId: this.participants().map(p => p.id)
  };

  // this.meetingApiService.create(payload).subscribe({
  //   next: () =>{ console.log('Meeting created'); this.router.navigate(['/dashboard/meeting'])},
  //   error: (err) => console.error(err)
  // });
  this.meetingApiService.create(payload).subscribe({
    next: () => { this.router.navigate(['/dashboard/meeting']); },
    error: (err) => console.error(err)
  });
}

ngOnDestroy() {
  this.participants.set([]);
}

}
