import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { LIVEKIT_ROUTES } from './features/livekit/livekit.routes';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { MainLayoutsComponent } from './layouts/main-layout/main-layouts/main-layouts.component';
import { ChatComponent } from './features/chat/components/chat/chat.component';
import { ChatPageComponent } from './features/chat/pages/chat-page.component';
import { MeetingPageComponent } from './features/meetings/pages/meeting-page/meeting-page.component';
import { CreateMeetingPageComponent } from './features/meetings/pages/create-meeting-page/create-meeting-page.component';
import { TestComponentComponent } from './features/meetings/components/test-component/test-component.component';
import { MeetingLinkPageComponent } from './features/meetings/pages/meeting-link-page/meeting-link-page.component';
import { TasksPageComponent } from './features/tasks/pages/tasks-page/tasks-page.component';
import { TaskDetailPageComponent } from './features/tasks/pages/task-detail-page/task-detail-page.component';
import { SettingsPageComponent } from './features/settings/settings-page.component';
import { ReportsPageComponent } from './features/reports/pages/reports-page/reports-page.component';


export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => Promise.resolve(AUTH_ROUTES)
  },
  {
    path: 'livekit',
    loadChildren: () => Promise.resolve(LIVEKIT_ROUTES)
  },
  {
    path: 'meeting/:meetingId',
    component: MeetingLinkPageComponent,
    canActivate: [authGuard]
  },
  {
    path: 'dashboard',
    component : MainLayoutsComponent,
    children : [
      {path: 'chat', component: ChatPageComponent},
      {path: 'meeting', component : MeetingPageComponent},
      {path: 'create', component : CreateMeetingPageComponent},
      {path: 'tasks', component : TasksPageComponent},
      {path: 'tasks/:taskId', component : TaskDetailPageComponent},
      {path: 'reports', component : ReportsPageComponent},
      {path: 'settings', component : SettingsPageComponent},
    ],
    canActivate: [authGuard]
  },
  {
path:'testtran', component:TestComponentComponent
  },

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'dashboard/chat'
  }
];
