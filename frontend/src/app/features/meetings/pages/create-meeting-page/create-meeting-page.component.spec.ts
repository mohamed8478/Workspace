import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateMeetingPageComponent } from './create-meeting-page.component';

describe('CreateMeetingPageComponent', () => {
  let component: CreateMeetingPageComponent;
  let fixture: ComponentFixture<CreateMeetingPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateMeetingPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateMeetingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
