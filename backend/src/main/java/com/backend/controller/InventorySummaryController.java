package com.backend.controller;

import com.backend.dto.MaterialStockDTO;
import com.backend.service.InventorySummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/inventory")
@CrossOrigin(origins = "http://localhost:5173")
public class InventorySummaryController {

    private final InventorySummaryService inventorySummaryService;

    @GetMapping("/materials")
    public ResponseEntity<List<MaterialStockDTO>> getMaterialStock() {
        return ResponseEntity.ok(inventorySummaryService.getMaterialStockSummary());
    }
}
