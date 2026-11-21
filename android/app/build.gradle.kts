plugins {
    id("com.android.application")
}

val releaseKeystore = System.getenv("ANDROID_KEYSTORE_FILE")

android {
    namespace = "com.algermusic.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.algermusic.app"
        minSdk = 24
        targetSdk = 36
        versionCode = 5100
        versionName = "5.1.0"
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = file(releaseKeystore)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        getByName("release") {
            signingConfig = if (releaseKeystore != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

val copyWebAssets = tasks.register<Sync>("copyWebAssets") {
    from(rootProject.file("../out/renderer")) {
        exclude("**/*.gz")
    }
    into(layout.projectDirectory.dir("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(copyWebAssets)
}
