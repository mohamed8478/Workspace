/**
 * LiveKit Feature Routes
 * Routing configuration for video conferencing feature
 */
import { Routes } from '@angular/router';
import { JoinRoomComponent } from './join-room/join-room.component';
import { RoomComponent } from './room/room.component';

export const LIVEKIT_ROUTES: Routes = [
  {
    path: '',
    component: JoinRoomComponent,
  },
  {
    path: 'room',
    component: RoomComponent,
  },
];
