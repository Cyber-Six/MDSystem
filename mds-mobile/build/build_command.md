### Build Commands

#### Replace 'mdsystem' with your user

ANDROID_HOME=/home/mdsystem/Android/Sdk ANDROID_SDK_ROOT=/home/mdsystem/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 eas build --platform android --local


#### command for prod

ANDROID_HOME=/home/mdsystem/Android/Sdk ANDROID_SDK_ROOT=/home/mdsystem/Android/Sdk JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 eas build --platform android --local --profile production
