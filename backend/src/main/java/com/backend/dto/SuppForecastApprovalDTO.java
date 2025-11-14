package com.backend.dto;

import lombok.Data;

@Data
public class SuppForecastApprovalDTO {
    private Long forecastId;
    private Integer action; // 1 = approve, 2 = reject
    private String note;
    private Long approverId;
}