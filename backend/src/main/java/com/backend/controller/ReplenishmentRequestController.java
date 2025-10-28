package com.backend.controller;

import com.backend.entity.ReplenishmentRequest;
import com.backend.repository.ReplenishmentRequestRepository;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/replenishment")
@CrossOrigin(origins = "http://localhost:5173")
public class ReplenishmentRequestController {

    private final ReplenishmentRequestRepository repo;

    public ReplenishmentRequestController(ReplenishmentRequestRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<ReplenishmentRequest> getAll() {
        return repo.findAll();
    }

    @PostMapping
    public ReplenishmentRequest create(@RequestBody ReplenishmentRequest req) {
        return repo.save(req);
    }
}
