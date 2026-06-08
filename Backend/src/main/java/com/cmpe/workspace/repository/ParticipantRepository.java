package com.cmpe.workspace.repository;

import com.cmpe.workspace.entity.Chat;
import com.cmpe.workspace.entity.Participant;
import com.cmpe.workspace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, Long> {

    @Query("SELECT DISTINCT p.chat from Participant p WHERE p.user.id = :user_id ORDER BY p.chat.lastMessageAt DESC ")
    List<Chat> findChatsByParticipants(@Param("user_id") Long userId);

    @Query("select p.user from Participant p where p.chat.id = :chatId and p.user.id != :userId")
    Optional<User> findReceiver(@Param("chatId") long chatId, @Param("userId") long userId);

    boolean existsByChatIdAndUserId(Long chatId, Long userId);
    List<Participant> findByChatId(Long chatId);


}
