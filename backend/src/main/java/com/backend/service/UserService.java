package com.backend.service;

import com.backend.dto.RegisterRequest;
import com.backend.dto.UserDTO;
import com.backend.entity.User;
import com.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public User registerUser(RegisterRequest request) {
        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPassword(request.getPassword()); // Không mã hóa theo yêu cầu
        user.setDateOfBirth(request.getDateOfBirth());
        user.setDepartment(request.getDepartment());
        user.setRole(request.getRole());
        user.setStatus("pending");

        return userRepository.save(user);
    }

    public User authenticateUser(String email, String password) {
        return userRepository.findByEmail(email)
                .filter(user -> user.getPassword().equals(password))
                .filter(user -> "approved".equals(user.getStatus()))
                .orElse(null);
    }

    public List<UserDTO> getPendingUsers() {
        return userRepository.findByStatusOrderByCreatedAtDesc("pending")
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<UserDTO> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public boolean updateUserStatus(Long userId, String status) {
        return userRepository.findById(userId)
                .map(user -> {
                    user.setStatus(status);
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    private UserDTO convertToDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFullName(user.getFullName());
        dto.setEmail(user.getEmail());
        dto.setDateOfBirth(user.getDateOfBirth());
        dto.setDepartment(user.getDepartment());
        dto.setRole(user.getRole());
        dto.setStatus(user.getStatus());
        dto.setPriority(user.getPriority());
        return dto;
    }

    public boolean emailExists(String email) {
        return userRepository.existsByEmail(email);
    }

    public void deleteUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new RuntimeException("Người dùng không tồn tại");
        }
        userRepository.deleteById(userId);
    }

    public boolean updateUserRoleAndPriority(Long userId, String newRole, Integer newPriority) {
        return userRepository.findById(userId)
                .map(user -> {
                    user.setRole(newRole);
                    user.setPriority(newPriority);
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }

    public boolean updatePassword(String email, String newPassword) {
        return userRepository.findByEmail(email)
                .map(user -> {
                    user.setPassword(newPassword); // Lưu password trực tiếp (không encode)
                    userRepository.save(user);
                    return true;
                })
                .orElse(false);
    }
}