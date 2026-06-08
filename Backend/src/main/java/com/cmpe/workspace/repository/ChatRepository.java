    package com.cmpe.workspace.repository;

    import com.cmpe.workspace.entity.Chat;
    import org.springframework.data.jpa.repository.JpaRepository;
    import org.springframework.data.jpa.repository.Query;
    import org.springframework.data.repository.query.Param;
    import org.springframework.stereotype.Repository;

    @Repository
    public interface ChatRepository extends JpaRepository<Chat, Long> {

//        boolean existsDirectChatBetweenUsers(Long senderId, Long receiverId);
@Query("""
    SELECT COUNT(c) > 0 FROM Chat c
    WHERE c.type = 'DIRECT'
    AND EXISTS (
        SELECT p FROM Participant p WHERE p.chat = c AND p.user.id = :userId1
    )
    AND EXISTS (
        SELECT p FROM Participant p WHERE p.chat = c AND p.user.id = :userId2
    )
""")
        boolean existsDirectChatBetweenUsers(@Param("userId1") Long userId1, @Param("userId2") Long userId2);
    }
