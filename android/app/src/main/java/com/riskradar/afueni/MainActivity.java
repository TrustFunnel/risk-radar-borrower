package com.riskradar.afueni;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AfueniSmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
