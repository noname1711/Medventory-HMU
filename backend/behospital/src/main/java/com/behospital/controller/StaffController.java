package com.behospital.controller;

import com.behospital.model.Staff;
import com.behospital.service.StaffService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/staff")
@CrossOrigin(origins = "*") // Cho phép frontend React truy cập API
public class StaffController {

    @Autowired
    private StaffService staffService;

    @GetMapping
    public List<Staff> getAllStaff() {
        return staffService.getAllStaff();
    }

    @PostMapping
    public Staff addStaff(@RequestBody Staff staff) {
        return staffService.addStaff(staff);
    }
}
