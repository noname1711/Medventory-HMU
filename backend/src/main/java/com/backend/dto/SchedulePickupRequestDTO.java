package com.backend.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SchedulePickupRequestDTO {
    private LocalDateTime scheduledAt;
    private String note; // optional
}
