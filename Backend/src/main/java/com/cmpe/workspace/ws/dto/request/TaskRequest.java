package com.cmpe.workspace.ws.dto.request;

import com.cmpe.workspace.enums.Department;
import com.cmpe.workspace.enums.TaskStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TaskRequest {
    private String title;
    private String description;
    private LocalDateTime dueDate;
    private TaskStatus status;
    private Department department;
    private Long assignedToId;
    private List<SubTaskRequest> subtasks;
}
