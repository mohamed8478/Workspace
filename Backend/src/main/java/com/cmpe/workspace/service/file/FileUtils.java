package com.cmpe.workspace.service.file;

import io.micrometer.common.util.StringUtils;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Slf4j
public class FileUtils {

    private FileUtils() {}

    public static byte[] readFileFromLocation(String fileUrl, String allowedBasePath) {
        if (StringUtils.isBlank(fileUrl)) {
            return new byte[0];
        }
        try {
            Path basePath = Paths.get(allowedBasePath).toAbsolutePath().normalize();
            Path filePath = Paths.get(fileUrl).toAbsolutePath().normalize();
            if (!filePath.startsWith(basePath) || !Files.isRegularFile(filePath)) {
                log.warn("Rejected file read outside upload directory");
                return new byte[0];
            }
            return Files.readAllBytes(filePath);
        } catch (IOException e) {
            log.warn("Nou file found in the path {}", fileUrl);
        }
        return new byte[0];
    }
}
