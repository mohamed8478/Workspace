package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.service.impl.MeetingAiService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai")
public class MeetingAiController {

    private final MeetingAiService meetingAiService;

    @GetMapping(
            value = "/meeting-question-stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public Flux<String> askQuestionStream(@RequestParam String roomName, @RequestParam String question) {
        return meetingAiService.askQuestionStream(roomName, question);
    }
}