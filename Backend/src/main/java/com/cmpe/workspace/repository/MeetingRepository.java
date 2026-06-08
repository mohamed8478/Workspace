package com.cmpe.workspace.repository;

import com.cmpe.workspace.entity.Meeting;
import com.cmpe.workspace.enums.MeetingStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MeetingRepository extends JpaRepository<Meeting, Long> {

    List<Meeting> findByStartTimeGreaterThanEqual(LocalDateTime dateTime);


//    Test Code
    List<Meeting> findByStatus(MeetingStatus status);

    List<Meeting> findByStatusOrderByStartTimeAsc(MeetingStatus status);

    @EntityGraph(attributePaths = {"participants", "participants.user"})
    @Query("SELECT m FROM Meeting m WHERE m.id = :id")
    Optional<Meeting> findByIdWithParticipants(@Param("id") Long id);

    // Finds ACTIVE meetings where userId is a participant
    @Query ("""
        SELECT DISTINCT m FROM Meeting m
        JOIN m.participants p
        WHERE m.status = 'ACTIVE'
        AND p.user.id = :userId
    """)
    List<Meeting> findActiveMeetingsByParticipant(@Param("userId") Long userId);
}
