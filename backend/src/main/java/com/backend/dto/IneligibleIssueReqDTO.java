package com.backend.dto;

import lombok.Data;

import java.util.List;

@Data
public class IneligibleIssueReqDTO {
    private IssueReqHeaderDTO request;

    // reasonCode: ALREADY_ISSUED | HAS_UNMAPPED_MATERIAL | NOT_ENOUGH_STOCK
    private String reasonCode;
    private String reasonMessage;

    // Nếu NOT_ENOUGH_STOCK => trả shortage theo từng vật tư
    private List<StockShortageDTO> shortages;

    // Nếu HAS_UNMAPPED_MATERIAL => danh sách dòng vật tư chưa map
    private List<String> unmappedItems;

    public static IneligibleIssueReqDTO of(IssueReqHeaderDTO request,
                                           String reasonCode,
                                           String reasonMessage,
                                           List<StockShortageDTO> shortages,
                                           List<String> unmappedItems) {
        IneligibleIssueReqDTO dto = new IneligibleIssueReqDTO();
        dto.setRequest(request);
        dto.setReasonCode(reasonCode);
        dto.setReasonMessage(reasonMessage);
        dto.setShortages(shortages);
        dto.setUnmappedItems(unmappedItems);
        return dto;
    }
}
