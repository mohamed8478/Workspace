package com.cmpe.workspace.repository;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.SimpleTimeZone;

@Repository
public interface UserRepository extends JpaRepository<User , Long> {

    Optional<User> findByEmail(String email);
    List<User> findByFullNameStartingWithIgnoreCase(String fullName);
    Boolean existsByEmail(String email);
    Boolean existsByRole(Role role);
}
