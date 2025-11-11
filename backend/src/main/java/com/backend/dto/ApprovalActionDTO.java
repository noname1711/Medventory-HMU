package com.backend.dto;

import lombok.Data;

@Data
public class ApprovalActionDTO {
    private Long issueReqId;
    private Integer action; // 1 = approve, 2 = reject, 3 = request adjustment
    private String note;
    private Long approverId;

    // Action constants
    public static final int ACTION_APPROVE = 1;
    public static final int ACTION_REJECT = 2;
    public static final int ACTION_REQUEST_ADJUSTMENT = 3;

    public String getActionName() {
        switch (action) {
            case 1: return "Phê duyệt";
            case 2: return "Từ chối";
            case 3: return "Yêu cầu điều chỉnh";
            default: return "Không xác định";
        }
    }
}