package com.cmpe.workspace.repository;

import com.cmpe.workspace.entity.Transcript;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TranscriptRepository extends JpaRepository<Transcript,Long > {
    List<Transcript> findByRoomName(String roomName);

    List<Transcript> findByRoomNameOrderBySpeechStartedAtAsc(String roomName);
}
