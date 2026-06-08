package com.cmpe.workspace.repository;

import com.cmpe.workspace.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByChatIdOrderByCreatedAtAsc(Long chatId);

    @Query("select count(m) from Message m where m.chat.id = :chatId and m.sender.id != :userId and m.status = com.cmpe.workspace.enums.MessageStatus.SENT")
    Integer CountUnseenMessages(@Param("chatId") Long chatId, @Param("userId") Long userId);

    @Query("select m from Message m where m.chat.id = :chatId and m.sender.id != :userId and m.status = com.cmpe.workspace.enums.MessageStatus.SENT ")
    List<Message> findByUnseenMessage(@Param("chatId") Long chatId,@Param("userId") Long userId);


//    and m.status = 'SEEN'  remove it part from query
    @Query(value = """
    select *
    from message m
    where m.chat_id = :chatId
    and m.type = 'TEXT'
    
    order by m.created_at desc
    limit 1
""", nativeQuery = true)
    Message findLastTextMessage(@Param("chatId") Long chatId);








}
