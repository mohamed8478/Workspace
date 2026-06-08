package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Chat;
import com.cmpe.workspace.entity.Message;
import com.cmpe.workspace.entity.Participant;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.repository.ParticipantRepository;
import com.cmpe.workspace.ws.dto.Notification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    private final SimpMessagingTemplate messagingTemplate;
    private final ParticipantRepository participantRepository;

    public void notifyParticipants(Chat chat, Message message, User sender) {

        Notification notification = new Notification();
        notification.setMessageId(message.getId());
        notification.setChatId(chat.getId());
        notification.setSenderId(sender.getId());
        notification.setContent(message.getContent());
        notification.setMessageType(message.getType());
        notification.setMediaUrl(message.getMediaFilePath());
        notification.setCreatedAt(message.getCreatedAt());

        List<Participant> participants = participantRepository.findByChatId(chat.getId());

        for (Participant participant : participants) {
            String userName = participant.getUser().getUsername();

            if (!userName.equals(sender.getUsername())) {
                messagingTemplate.convertAndSendToUser(
                        userName,
                        "/queue/messages",
                        notification
                );
            }
        }
    }

}
