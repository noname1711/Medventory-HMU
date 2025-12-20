package com.backend.repository;

import com.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    // giữ để tránh đụng controller/service ngay, dù về bảo mật nên đổi sau
    Optional<User> findByEmailAndPassword(String email, String password);

    boolean existsByEmail(String email);

    List<User> findByDepartmentId(Long departmentId);

    // status.code = 'PENDING'/'APPROVED'
    List<User> findByStatus_Code(String statusCode);

    // role.code + status.code
    List<User> findByRole_CodeAndStatus_Code(String roleCode, String statusCode);
}
