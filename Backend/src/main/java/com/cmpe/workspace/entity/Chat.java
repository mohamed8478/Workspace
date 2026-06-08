package com.cmpe.workspace.entity;

import com.cmpe.workspace.enums.ChatType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;


@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
public class Chat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    private ChatType type;
    private String name;

    @OneToMany(mappedBy = "chat")
    private List<Participant> participants;

    @OneToMany(mappedBy = "chat")
    private List<Message> messages;

    private LocalDateTime lastMessageAt;

}
