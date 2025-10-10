package com.behospital.service;

import com.behospital.model.Staff;
import com.behospital.repository.StaffRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class StaffService {

    @Autowired
    private StaffRepository staffRepository;

    public List<Staff> getAllStaff() {
        return staffRepository.findAll();
    }

    public Staff addStaff(Staff staff) {
        return staffRepository.save(staff);
    }

    public boolean emailExists(String email) {
        return staffRepository.existsByEmail(email);
    }
}
