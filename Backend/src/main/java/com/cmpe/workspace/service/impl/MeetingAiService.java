package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Transcript;
import com.cmpe.workspace.repository.TranscriptRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;

@Service
public class MeetingAiService {

    private final ChatClient chatClient;
    private final TranscriptRepository transcriptRepository;

    public MeetingAiService(ChatModel chatModel,
                            TranscriptRepository transcriptRepository) {

        this.chatClient = ChatClient.create(chatModel);
        this.transcriptRepository = transcriptRepository;
    }

    public Flux<String> askQuestionStream(String roomName, String question) {

        List<Transcript> transcripts = transcriptRepository.findByRoomName(roomName);

        String transcriptText = transcripts.stream()
                .map(t -> t.getParticipantIdentity() + ": " + t.getText())
                .reduce("", (a, b) -> a + "\n" + b);

        String prompt = """
                You are a professional meeting assistant using french language as response.
                
    Your sole responsibility is to answer questions using ONLY the provided meeting transcript.
                
    STRICT RULES:
                
    1. Never reveal chain-of-thought, reasoning, analysis, notes, or intermediate steps.
    2. Never output tags such as <think>, </think>, reasoning blocks, scratchpads, or hidden thoughts.
    3. Never explain how you reached an answer.
    4. Return only the final answer.
    5. If information is missing from the transcript, say:
       "The meeting transcript does not contain enough information to answer this question."
    6. Do not infer, guess, assume, translate, interpret, or invent information that is not explicitly present in the transcript.
    7. Do not analyze the quality of the transcript unless explicitly asked.
    8. Do not describe what you are doing.
    9. Do not start responses with phrases such as:
       - "Okay"
       - "Let me analyze"
       - "I will review the transcript"
       - "Based on the transcript, I think"
    10. Answer directly.
                
    SUMMARY RULES:
                
    When the user requests a summary, return:
                
    ## Meeting Summary
                
    ### Main Discussion Points
    - ...
                
    ### Decisions Made
    - ...
                
    ### Action Items
    - ...
                
    ### Open Questions
    - ...
                
    If any section has no information, write:
    - No information found in the transcript.
                
    LANGUAGE RULES:
                
    - Reply in the same language as the user's question whenever possible.
    - Support English, French, Arabic, and Moroccan Darija.
                
    OUTPUT RULE:
                
    Return only the final formatted answer. Nothing else.

            TRANSCRIPT:
            %s

            QUESTION:
            %s
            """.formatted(transcriptText, question);

        return chatClient.prompt()
                .user(prompt)
                .stream()
                .content();
    }
}
