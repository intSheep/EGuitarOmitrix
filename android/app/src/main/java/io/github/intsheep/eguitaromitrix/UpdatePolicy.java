package io.github.intsheep.eguitaromitrix;

import java.io.IOException;
import java.util.Arrays;

/** Platform-independent release validation; inputs are untrusted release metadata. */
final class UpdatePolicy {
    static final long MAX_APK = 500L * 1024 * 1024;
    static long versionCode(String version) throws IOException {
        if (version == null || !version.matches("[0-9]{1,2}\\.[0-9]{1,2}\\.[0-9]{1,2}")) throw new IOException("版本号无效");
        String[] parts = version.split("\\.");
        return Long.parseLong(parts[0]) * 10000 + Long.parseLong(parts[1]) * 100 + Long.parseLong(parts[2]) + 1;
    }
    static boolean validMetadata(long bytes, String hash) {
        return bytes > 0 && bytes <= MAX_APK && hash != null && hash.matches("[a-f0-9]{64}");
    }
    static void verifyIntegrity(long actualBytes, long expectedBytes, String actualHash, String expectedHash) throws IOException {
        if (!validMetadata(expectedBytes, expectedHash) || actualBytes != expectedBytes || !expectedHash.equals(actualHash))
            throw new IOException("文件校验失败，请重试");
    }
    static boolean sameSigners(Object[] installed, Object[] incoming) {
        return installed != null && incoming != null && installed.length > 0 && installed.length == incoming.length &&
            Arrays.asList(incoming).containsAll(Arrays.asList(installed)) && Arrays.asList(installed).containsAll(Arrays.asList(incoming));
    }
}
