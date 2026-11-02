package io.github.intsheep.eguitaromitrix;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.IOException;

/** Synthetic metadata/certificates only; no release key or owner data. */
public class UpdatePolicyTest {
    private static final String HASH = "a".repeat(64);
    @Test public void releaseVersionMatchesPackagingAndExcludesPrereleases() throws Exception {
        assertEquals(401, UpdatePolicy.versionCode("0.4.0"));
        assertTrue(UpdatePolicy.versionCode("0.4.1") > UpdatePolicy.versionCode("0.4.0"));
        for (String value : new String[]{"v0.4.0", "0.4.1-beta", "100.0.0", "1.2", "1.-1.0", "1.2.3/../"}) {
            assertThrows(IOException.class, () -> UpdatePolicy.versionCode(value));
        }
    }
    @Test public void truncatedTamperedAndOversizedPackagesNeverPass() throws Exception {
        UpdatePolicy.verifyIntegrity(1024, 1024, HASH, HASH);
        assertThrows(IOException.class, () -> UpdatePolicy.verifyIntegrity(1023, 1024, HASH, HASH));
        assertThrows(IOException.class, () -> UpdatePolicy.verifyIntegrity(1024, 1024, "b".repeat(64), HASH));
        assertFalse(UpdatePolicy.validMetadata(0, HASH));
        assertFalse(UpdatePolicy.validMetadata(UpdatePolicy.MAX_APK + 1, HASH));
        assertFalse(UpdatePolicy.validMetadata(1024, "../fake"));
    }
    @Test public void replacementMustHaveExactlyTheInstalledSigners() {
        assertTrue(UpdatePolicy.sameSigners(new String[]{"release"}, new String[]{"release"}));
        assertTrue(UpdatePolicy.sameSigners(new String[]{"a", "b"}, new String[]{"b", "a"}));
        assertFalse(UpdatePolicy.sameSigners(new String[]{"release"}, new String[]{"debug"}));
        assertFalse(UpdatePolicy.sameSigners(new String[]{"release"}, new String[]{"release", "other"}));
        assertFalse(UpdatePolicy.sameSigners(new String[]{}, new String[]{}));
        assertFalse(UpdatePolicy.sameSigners(null, new String[]{"release"}));
    }
}
