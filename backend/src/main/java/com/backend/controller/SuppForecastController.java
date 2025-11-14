package com.backend.controller;

import com.backend.dto.SuppForecastApprovalDTO;
import com.backend.service.SuppForecastService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/supp-forecast")
@CrossOrigin(origins = "http://localhost:5173")
public class SuppForecastController {

    @Autowired
    private SuppForecastService suppForecastService;

    @GetMapping("/bgh/pending")
    public ResponseEntity<?> getPendingForecasts(@RequestParam Long bghId) {
        return suppForecastService.getPendingForecasts(bghId);
    }

    @GetMapping("/bgh/processed")
    public ResponseEntity<?> getProcessedForecasts(@RequestParam Long bghId) {
        return suppForecastService.getProcessedForecasts(bghId);
    }

    @PostMapping("/approve")
    public ResponseEntity<?> approveForecast(@RequestBody SuppForecastApprovalDTO request) {
        return suppForecastService.approveForecast(request);
    }

    @GetMapping("/bgh/stats")
    public ResponseEntity<?> getStats(@RequestParam Long bghId) {
        return suppForecastService.getStats(bghId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getForecastDetail(@PathVariable Long id, @RequestParam Long userId) {
        try {
            return ResponseEntity.ok().body("Chi tiết dự trù #" + id);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Lỗi: " + e.getMessage());
        }
    }
}