package com.cmpe.workspace.repository;

import com.cmpe.workspace.entity.MeetingParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingParticipantRepository extends JpaRepository<MeetingParticipant, Long> {
    boolean existsByMeetingIdAndUserId(Long meetingId, Long userId);
}
