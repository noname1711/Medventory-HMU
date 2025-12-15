package com.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ReceiptResponseDTO {
    private boolean success;
    private String message;
    private ReceiptHeaderDTO header;
    private List<ReceiptDetailDTO> details;
    private Map<String, Object> summary;

    public ReceiptResponseDTO(boolean success, String message, ReceiptHeaderDTO header,
                              List<ReceiptDetailDTO> details, Map<String, Object> summary) {
        this.success = success;
        this.message = message;
        this.header = header;
        this.details = details;
        this.summary = summary;
    }

    public static ReceiptResponseDTO success(String message, ReceiptHeaderDTO header,
                                             List<ReceiptDetailDTO> details, Map<String, Object> summary) {
        return new ReceiptResponseDTO(true, message, header, details, summary);
    }

    public static ReceiptResponseDTO error(String message) {
        return new ReceiptResponseDTO(false, message, null, null, null);
    }
}
